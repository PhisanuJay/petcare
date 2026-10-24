import { speciesOf } from '../petUtils.js';

export default function PetPhoto({ pet, size = '' }) {
  const cls = `pet-photo ${size}`;
  if (pet?.photo) return <img className={cls} src={pet.photo} alt={pet.name} />;
  return <span className={cls}>{speciesOf(pet?.species).emoji}</span>;
}
