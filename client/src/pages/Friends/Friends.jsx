
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchGroups,
  fetchGroupSettlements,
} from '../../services/groupservice';
import './Friends.css';

function formatCurrency(amountInPaise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amountInPaise / 100);
}

function Friends() {
  const { user } = useAuth();

  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadFriends() {
      setLoading(true);
      setError('');

      try {
        const groups = await fetchGroups();

        const currentEmail = user?.email?.toLowerCase();

        if (!currentEmail) {
          throw new Error('Your account email is unavailable.');
        }

        const friendMap = new Map();

        await Promise.all(
          groups.map(async (group) => {
            const currentMember = group.members?.find(
              (member) =>
                member.email?.toLowerCase() === currentEmail
            );

            if (!currentMember) return;

            const settlements = await fetchGroupSettlements(group._id);

            settlements.forEach((settlement) => {
              const currentId = currentMember._id.toString();
              const fromId = settlement.from?.userId?.toString();
              const toId = settlement.to?.userId?.toString();

              let friend;
              let direction;

              if (fromId === currentId) {
                friend = settlement.to;
                direction = 'youOwe';
              } else if (toId === currentId) {
                friend = settlement.from;
                direction = 'owedToYou';
              } else {
                return;
              }

              if (!friend?.userId) return;

              const friendId = friend.userId.toString();

              if (!friendMap.has(friendId)) {
                friendMap.set(friendId, {
                  userId: friendId,
                  name: friend.name || 'Unknown member',
                  youOwe: 0,
                  owedToYou: 0,
                  groups: [],
                });
              }

              const friendData = friendMap.get(friendId);
              const amount = Number(settlement.amount) || 0;

              friendData[direction] += amount;

              friendData.groups.push({
                groupId: group._id,
                groupName: group.name,
                amount,
                direction,
              });
            });
          })
        );

        if (!cancelled) {
          setFriends(
            Array.from(friendMap.values()).map((friend) => ({
              ...friend,
              netBalance: friend.owedToYou - friend.youOwe,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load friends and balances.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (user?.email) {
      loadFriends();
    } else {
      setLoading(false);
      setError('Please log in to view your friends.');
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalYouOwe = useMemo(
    () => friends.reduce((total, friend) => total + friend.youOwe, 0),
    [friends]
  );

  const totalOwedToYou = useMemo(
    () => friends.reduce((total, friend) => total + friend.owedToYou, 0),
    [friends]
  );

  const filteredFriends = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return friends;

    return friends.filter((friend) =>
      friend.name.toLowerCase().includes(query)
    );
  }, [friends, search]);

  return (
    <main className="friends-page">
      <header className="friends-header">
        <div>
          <p className="friends-eyebrow">EQUISPLIT WORKSPACE</p>
          <h1>Friends & Balances</h1>
          <p className="friends-subtitle">
            Keep track of shared expenses and see who owes whom.
          </p>
        </div>

        <button
          type="button"
          className="friends-refresh-button"
          onClick={() => window.location.reload()}
        >
          ↻ Refresh
        </button>
      </header>

      <section className="friends-summary">
        <article className="friends-summary-card">
          <div className="friends-summary-icon owe-icon">↑</div>
          <div>
            <p>You owe</p>
            <h2>{formatCurrency(totalYouOwe)}</h2>
          </div>
        </article>

        <article className="friends-summary-card">
          <div className="friends-summary-icon owed-icon">↓</div>
          <div>
            <p>Owed to you</p>
            <h2>{formatCurrency(totalOwedToYou)}</h2>
          </div>
        </article>

        <article className="friends-summary-card">
          <div className="friends-summary-icon people-icon">♧</div>
          <div>
            <p>People</p>
            <h2>{friends.length}</h2>
          </div>
        </article>
      </section>

      <section className="friends-list-section">
        <div className="friends-list-heading">
          <div>
            <h2>Your people</h2>
            <p>Balances calculated from your group settlements.</p>
          </div>

          <input
            type="search"
            className="friends-search"
            placeholder="Search friends..."
            aria-label="Search friends"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="friends-state">
            <div className="friends-loader" />
            <p>Calculating your balances...</p>
          </div>
        ) : error ? (
          <div className="friends-state">
            <h3>Couldn't load balances</h3>
            <p>{error}</p>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="friends-state">
            <div className="friends-empty-icon">♧</div>
            <h3>{search ? 'No matching friends' : 'No shared balances yet'}</h3>
            <p>
              {search
                ? 'Try another name.'
                : 'When you share expenses with people in a group, their balances will appear here.'}
            </p>
          </div>
        ) : (
          <div className="friends-list">
            {filteredFriends.map((friend) => (
              <article className="friend-card" key={friend.userId}>
                <div className="friend-avatar">
                  {friend.name.charAt(0).toUpperCase()}
                </div>

                <div className="friend-main">
                  <h3>{friend.name}</h3>
                  <p>
                    {new Set(friend.groups.map((group) => group.groupId)).size}{' '}
                    shared{' '}
                    {new Set(friend.groups.map((group) => group.groupId)).size === 1
                      ? 'group'
                      : 'groups'}
                  </p>
                </div>

                <div className="friend-balance">
                  {friend.netBalance > 0 ? (
                    <>
                      <strong className="balance-positive">
                        {formatCurrency(friend.netBalance)}
                      </strong>
                      <span>Owes you</span>
                    </>
                  ) : friend.netBalance < 0 ? (
                    <>
                      <strong className="balance-negative">
                        {formatCurrency(Math.abs(friend.netBalance))}
                      </strong>
                      <span>You owe</span>
                    </>
                  ) : (
                    <>
                      <strong className="balance-settled">
                        ₹0.00
                      </strong>
                      <span>Settled up</span>
                    </>
                  )}
                </div>

                <div className="friend-group-details">
                  {friend.groups.map((group, index) => (
                    <div
                      className="friend-group-row"
                      key={`${group.groupId}-${index}`}
                    >
                      <span>{group.groupName}</span>
                      <span>
                        {group.direction === 'youOwe' ? 'You owe' : 'Owes you'}{' '}
                        {formatCurrency(group.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Friends;
