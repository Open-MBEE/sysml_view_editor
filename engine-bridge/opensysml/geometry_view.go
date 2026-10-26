package engine

import (
	"context"
	"fmt"
	"math"

	"github.com/Open-MBEE/OpenSysML/internal/exec/runtime"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/ast/astcodec"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/parser"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/source"
)

type studioSpatialPlacement struct {
	Frame  string        `json:"frame"`
	Origin [3]float64    `json:"origin"`
	Basis  [3][3]float64 `json:"basis"`
}

func (e *Engine) studioPlacement(cached *cachedModel, sym *symbols.Symbol) (*studioSpatialPlacement, error) {
	rt := e.newRuntime(context.Background(), cached)
	inst, err := rt.Instantiate(sym)
	if err != nil {
		return nil, err
	}
	if _, present := inst.FeatureValues["coordinateFrame"]; !present {
		return nil, nil
	}
	p := parser.New(source.New("<geometry-frame>", []byte("coordinateFrame")))
	expression := p.ParseExpression()
	evaluation := runtime.NewEvalContextIn(rt, evalScope(sym, cached), inst)
	var value runtime.Value
	rt.Resolver().Scratch(astcodec.Reachable(expression), func() { value, err = evaluation.Eval(expression) })
	if err != nil {
		return nil, err
	}
	frame := value.CoordinateFrame()
	if frame == nil {
		return nil, fmt.Errorf("coordinateFrame did not evaluate to a coordinate frame")
	}
	return studioFramePlacement(rt, cached, frame, map[*runtime.CoordinateFrame]bool{})
}

// Compose the engine's frame poses; never infer placement from drawing layout.
func studioFramePlacement(rt *runtime.Context, cached *cachedModel, frame *runtime.CoordinateFrame, seen map[*runtime.CoordinateFrame]bool) (*studioSpatialPlacement, error) {
	if seen[frame] || len(seen) >= 32 {
		return nil, fmt.Errorf("cyclic or excessive coordinate-frame chain")
	}
	seen[frame] = true
	origin, basis, parent, err := rt.StudioFramePose(frame)
	if err != nil {
		return nil, err
	}
	if parent.Decl == nil {
		return nil, fmt.Errorf("source coordinate frame has no declared identity")
	}
	out := &studioSpatialPlacement{Frame: cached.Index.GetFQN(parent.Decl)}
	if out.Frame == "" {
		return nil, fmt.Errorf("source coordinate frame identity is unavailable")
	}
	var scale [3]float64
	for i, axis := range parent.Axes {
		term := unitTermToProto(axis.Term)
		if len(term.Factors) != 1 || term.Factors[0].UnitId != "SI::metre" || float64(term.Factors[0].Exponent) != 1 || float64(term.ScaleDen) <= 0 {
			return nil, fmt.Errorf("coordinate-frame axes must be resolved length units")
		}
		scale[i] = float64(term.ScaleNum) / float64(term.ScaleDen)
		if scale[i] <= 0 || math.IsInf(scale[i], 0) || math.IsNaN(scale[i]) {
			return nil, fmt.Errorf("invalid coordinate-frame unit scale")
		}
		out.Origin[i] = origin[i] * scale[i]
	}
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			out.Basis[i][j] = basis[i][j] * scale[i] / scale[j]
		}
	}
	if parent != frame && parent.Transformation != nil {
		ancestor, err := studioFramePlacement(rt, cached, parent, seen)
		if err != nil {
			return nil, err
		}
		var composed studioSpatialPlacement
		composed.Frame = ancestor.Frame
		composed.Origin = ancestor.Origin
		for i := 0; i < 3; i++ {
			for j := 0; j < 3; j++ {
				composed.Origin[i] += ancestor.Basis[i][j] * out.Origin[j]
				for k := 0; k < 3; k++ {
					composed.Basis[i][k] += ancestor.Basis[i][j] * out.Basis[j][k]
				}
			}
		}
		out = &composed
	}
	for i := 0; i < 3; i++ {
		if math.IsNaN(out.Origin[i]) || math.IsInf(out.Origin[i], 0) {
			return nil, fmt.Errorf("nonfinite frame origin")
		}
		for j := 0; j < 3; j++ {
			if math.IsNaN(out.Basis[i][j]) || math.IsInf(out.Basis[i][j], 0) {
				return nil, fmt.Errorf("nonfinite frame basis")
			}
		}
	}
	return out, nil
}
