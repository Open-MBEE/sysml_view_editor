package runtime

import "fmt"

// StudioFramePose exposes the engine's own placement calculation to the local
// geometry adapter. Coordinates are still in the source frame's axis units.
func (ctx *Context) StudioFramePose(frame *CoordinateFrame) ([]float64, [][]float64, *CoordinateFrame, error) {
	if frame == nil || len(frame.Axes) != 3 {
		return nil, nil, nil, fmt.Errorf("geometry requires a three-dimensional coordinate frame")
	}
	if frame.Transformation == nil {
		pose := identityPose(3)
		return pose.origin, pose.basis, frame, nil
	}
	transform := frame.Transformation
	if transform.Target == nil {
		copy := *transform
		copy.Target = frame
		transform = &copy
	}
	if transform.Source == nil || transform.Target == nil {
		return nil, nil, nil, fmt.Errorf("geometry transformation has no source or target frame")
	}
	if err := transform.sameDimensions("geometry"); err != nil {
		return nil, nil, nil, err
	}
	if len(transform.Source.Axes) != 3 || len(transform.Target.Axes) != 3 {
		return nil, nil, nil, fmt.Errorf("geometry transformation requires three source and target axes")
	}
	for i := 0; i < 3; i++ {
		if !transform.Source.Axes[i].Term.Commensurable(transform.Target.Axes[i].Term) {
			return nil, nil, nil, fmt.Errorf("geometry source and target axis units are incompatible")
		}
	}
	pose, err := ctx.poseOf("geometry", transform)
	if err != nil {
		return nil, nil, nil, err
	}
	if len(pose.origin) != 3 || len(pose.basis) != 3 {
		return nil, nil, nil, fmt.Errorf("geometry transformation is not three-dimensional")
	}
	if _, ok := invert(pose.basis); !ok {
		return nil, nil, nil, fmt.Errorf("geometry basis is singular")
	}
	if pose.reorients() {
		for i := 1; i < 3; i++ {
			if !(&MeasurementRef{Unit: transform.Source.Axes[0]}).equal(&MeasurementRef{Unit: transform.Source.Axes[i]}) {
				return nil, nil, nil, fmt.Errorf("geometry cannot reorient axes with different units")
			}
		}
	}
	return pose.origin, pose.basis, transform.Source, nil
}
