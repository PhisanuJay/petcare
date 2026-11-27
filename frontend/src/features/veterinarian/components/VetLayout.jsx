import '../vet.css';
import '../vet-pages.css';

/** Page frame for veterinarian content inside StaffWorkspace (no top navbar). */
export default function VetLayout({ children, inner = true }) {
  return (
    <div className={`vet-site${inner ? ' vet-inner' : ''}`}>
      {children}
    </div>
  );
}
