
import { Link } from 'react-router-dom';

function GroupCard({ group }) {
  const memberCount = group.members?.length || 0;

  const createdDate = group.createdAt
    ? new Date(group.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Date unavailable';

  return (
    <Link
      to={`/groups/${group._id}`}
      className="group-card"
      aria-label={`Open ${group.name}, ${memberCount} members`}
    >
      <div className="group-card-top">
        <div className="group-icon">G</div>

        <span className="group-card-arrow">↗</span>
      </div>

      <div className="group-card-content">
        <h3>{group.name}</h3>

        <p>
          <span className="group-member-icon">♙</span>
          {memberCount}{' '}
          {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>

      <div className="group-card-footer">
        <span>Created {createdDate}</span>
        <span className="group-open-link">View group →</span>
      </div>
    </Link>
  );
}

export default GroupCard;
