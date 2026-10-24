export default function UserAvatar({ user, className = 'avatar' }) {
  if (user?.avatar) return <img className={className} src={user.avatar} alt="" />;
  return <span className={className}>{user?.firstName?.charAt(0) ?? '?'}</span>;
}
