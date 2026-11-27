import { Navigate } from 'react-router-dom';
import { useAdoptionBasePath } from '../useAdoptionBasePath.js';

/** เพิ่มสัตว์ทำที่ประกาศของเจ้าของ — แอดมินไปหน้ารายการประกาศ */
export default function AddAnimalPage() {
  const base = useAdoptionBasePath();
  return <Navigate to={`${base}/animals`} replace />;
}