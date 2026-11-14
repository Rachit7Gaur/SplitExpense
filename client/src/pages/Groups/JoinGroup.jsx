import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { acceptGroupInvite } from '../../services/groupservice';

function JoinGroup() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function joinGroup() {
      try {
        const result = await acceptGroupInvite(token);

        setMessage('You have successfully joined the group!');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    joinGroup();
  }, [token]);

  return (
    <main className="group-details-page">
      <h1>Join SplitExpense Group</h1>

      {loading && <p>Accepting your invitation...</p>}

      {message && (
        <>
          <p>{message}</p>
          <button onClick={() => navigate('/groups')}>
            Go to My Groups
          </button>
        </>
      )}

      {error && (
        <>
          <p className="group-details-error">{error}</p>
          <button onClick={() => navigate('/groups')}>
            Go to My Groups
          </button>
        </>
      )}
    </main>
  );
}

export default JoinGroup;