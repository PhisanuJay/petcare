import { useLocation } from 'react-router-dom';

/** base path ของโต๊ะหาบ้าน — ใต้โรงแรมหรือ legacy /adoption */
export function useAdoptionBasePath() {
  const { pathname } = useLocation();
  return pathname.startsWith('/admin/adoption') ? '/admin/adoption' : '/adoption';
}
