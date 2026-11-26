import { bookingPetPhotoSrc, petPhotoSrc, speciesDefaultPhoto } from '../petUtils.js';

/**
 * Circular pet thumbnail — upload or stock photo from `public/pets/`, not emoji.
 */
export default function PetAvatarImg({
  pet,
  booking,
  species,
  photo,
  className = 'person-avatar pet',
  alt = '',
  size,
}) {
  const resolved = (() => {
    if (typeof photo === 'string' && photo.trim()) return photo.trim();
    if (pet) return petPhotoSrc(pet);
    if (booking) return bookingPetPhotoSrc(booking);
    return speciesDefaultPhoto(species);
  })();

  const style = size ? { width: size, height: size } : undefined;

  return (
    <img
      className={className}
      src={resolved}
      alt={alt || pet?.name || booking?.petName || 'สัตว์เลี้ยง'}
      loading="lazy"
      decoding="async"
      style={style}
    />
  );
}