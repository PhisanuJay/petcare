import { petPhotoSrc } from '../petUtils.js';

export default function PetPhoto({ pet, size = '', style }) {
  const cls = `pet-photo ${size}`;
  const alt = pet?.name?.trim() ? pet.name : 'สัตว์เลี้ยง';
  return <img className={cls} style={style} src={petPhotoSrc(pet)} alt={alt} loading="lazy" decoding="async" />;
}
