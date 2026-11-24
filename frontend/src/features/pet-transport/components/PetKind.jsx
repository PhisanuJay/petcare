const SPECIES = {
  dog: 'สุนัข',
  cat: 'แมว',
  rabbit: 'กระต่าย',
  bird: 'นก',
  rodent: 'หนู',
  reptile: 'สัตว์เลื้อยคลาน',
  other: 'อื่นๆ',
};

export default function PetKind({ booking }) {
  const species = SPECIES[booking?.petSpecies];
  const breed = booking?.petBreed;
  if (!species && !breed) return null;
  return (
    <span className={`driver-pet${booking?.petSpecies ? ` is-${booking.petSpecies}` : ''}`}>
      {species ? <b>{species}</b> : null}
      {breed ? <span>{breed}</span> : null}
    </span>
  );
}
