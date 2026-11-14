
import { useNavigate } from 'react-router-dom';

function GroupCard({ group }) {
  const navigate = useNavigate();

  function handleOpenGroup() {
    navigate(`/groups/${group._id}`);
  }

  return (
    <article
      className="group-card"
      onClick={handleOpenGroup}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          handleOpenGroup();
        }
      }}
    >
      <div className="group-icon">G</div>

      <h3>{group.name}</h3>

      <p>
        {group.members.length}{' '}
        {group.members.length === 1 ? 'member' : 'members'}
      </p>

      <span className="group-date">
        Created {new Date(group.createdAt).toLocaleDateString()}
      </span>

      <span className="group-open-link">
        View group →
      </span>
    </article>
  );
}

export default GroupCard;
