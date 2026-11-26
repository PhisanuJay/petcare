import { Navigate } from 'react-router-dom';

/** Staff adds animals via Adoption Hub — redirect to management list. */
export default function AddAnimalPage() {
  return <Navigate to="/adoption/animals" replace />;
}