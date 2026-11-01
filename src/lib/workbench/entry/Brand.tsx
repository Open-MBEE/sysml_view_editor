import { Button } from '$lib/ui/primitives/button';

export function Brand({ onHome }: { onHome: () => void }) {
  return (
    <Button asChild variant="ghost" className="product-brand">
      <a
        href="/"
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onHome();
        }}
        aria-label="OpenMBEE View Editor home"
      >
        <span>OpenMBEE</span>
        <span>View Editor</span>
      </a>
    </Button>
  );
}
export const repository = 'https://github.com/Open-MBEE/sysml_view_editor';
