import { speciesOf } from '../petUtils.js';

export default function PetPhoto({ pet, size = '', style }) {
  const cls = `pet-photo ${size}`;
  if (pet?.photo) return <img className={cls} style={style} src={pet.photo} alt={pet.name} />;
  return <span className={cls} style={style}>{speciesOf(pet?.species).emoji}</span>;
}
