
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const CURRENT_YEAR = new Date().getFullYear();

const features = [
  {
    icon: '👥',
    title: 'Groups and trips',
    description:
      'Create groups for trips, roommates or everyday activities and invite everyone easily.',
  },
  {
    icon: '🧾',
    title: 'Flexible expense splits',
    description:
      'Split expenses equally or use custom amounts, percentages and shares.',
  },
  {
    icon: '⚖️',
    title: 'Simplified settlements',
    description:
      'See who owes whom and get clear settlement suggestions with fewer payments.',
  },
];

function Home() {
  const [isScrolled, setIsScrolled] = useState(false);

  // Detect scrolling for navbar animation
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    // Set initial state
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="home-page">
      {/* Navigation */}
      <header
        className={`home-navbar ${isScrolled ? 'scrolled' : ''}`}
      >
        <Link to="/" className="home-brand">
          <span className="home-brand-icon">◐</span>
          <span>EquiSplit</span>
        </Link>

        <nav className="home-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
        </nav>

        <div className="home-nav-actions">
          <Link to="/login" className="home-login-btn">
            Log in
          </Link>

          <Link to="/login" className="home-signup-btn">
            Sign up free
          </Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="home-hero">
          <div className="home-hero-content">
            <span className="home-eyebrow">
              Free for friends, roommates and trips
            </span>

            <h1>
              Split expenses.
              <br />
              Keep the friendship.
            </h1>

            <p className="home-hero-description">
              Track shared bills, see who owes whom, and settle up
              in a few taps. No awkward reminders.
            </p>

            <div className="home-hero-actions">
              <Link to="/login" className="home-primary-btn">
                Get started free
              </Link>

              <a
                href="#how-it-works"
                className="home-secondary-btn"
              >
                See how it works
              </a>
            </div>

            <div className="home-trust-note">
              <span>✓</span>
              Simple expense tracking for everyone
            </div>
          </div>

          {/* Sample Expense Preview */}
          <div className="home-preview-wrapper">
            <div className="home-expense-preview">
              <div className="preview-header">
                <div>
                  <h3>Goa Trip</h3>
                  <p>4 people · 12 expenses</p>
                </div>

                <span className="preview-status">
                  Active
                </span>
              </div>

              <div className="preview-balance">
                <p>You are owed</p>
                <h2>₹3,450.00</h2>
              </div>

              <div className="preview-person">
                <span>Aarav owes you</span>
                <strong className="positive-amount">
                  ₹1,800
                </strong>
              </div>

              <div className="preview-person">
                <span>Meera owes you</span>
                <strong className="positive-amount">
                  ₹2,100
                </strong>
              </div>

              <div className="preview-person">
                <span>You owe Kabir</span>
                <strong className="negative-amount">
                  ₹450
                </strong>
              </div>

              <Link
                to="/login"
                className="preview-settle-btn"
              >
                Settle up
              </Link>
            </div>

            <div className="preview-decoration preview-decoration-one" />
            <div className="preview-decoration preview-decoration-two" />
          </div>
        </section>

        {/* Features Section */}
        <section className="home-features" id="features">
          <div className="home-section-heading">
            <span className="home-section-label">
              WHAT YOU GET
            </span>

            <h2>Everything shared expenses need.</h2>

            <p>
              Less confusion, clearer balances and easier settlements.
            </p>
          </div>

          <div className="home-feature-grid">
            {features.map((feature) => (
              <article
                className="home-feature-card"
                key={feature.title}
              >
                <div className="home-feature-icon">
                  {feature.icon}
                </div>

                <h3>{feature.title}</h3>

                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section
          className="home-how-section"
          id="how-it-works"
        >
          <div className="home-section-heading">
            <span className="home-section-label">
              HOW IT WORKS
            </span>

            <h2>Three steps. No confusion.</h2>

            <p>
              Start tracking your shared expenses in minutes.
            </p>
          </div>

          <div className="home-steps-grid">
            <article className="home-step">
              <span className="home-step-number">01</span>

              <h3>Create a group</h3>

              <p>
                Start a group for your trip, flatmates or any
                shared activity.
              </p>
            </article>

            <article className="home-step">
              <span className="home-step-number">02</span>

              <h3>Add expenses</h3>

              <p>
                Record payments and choose how the expense
                should be split.
              </p>
            </article>

            <article className="home-step">
              <span className="home-step-number">03</span>

              <h3>Settle up</h3>

              <p>
                Check balances and follow settlement suggestions
                to clear dues.
              </p>
            </article>
          </div>

          {/* Bottom CTA */}
          <div className="home-bottom-cta">
            <div>
              <h2>Ready to split smarter?</h2>

              <p>
                Make shared expenses easier with EquiSplit.
              </p>
            </div>

            <Link
              to="/login"
              className="home-primary-btn"
            >
              Get started free →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <Link to="/" className="home-brand footer-brand">
          <span className="home-brand-icon">◐</span>
          <span>EquiSplit</span>
        </Link>

        <p>
          © {CURRENT_YEAR} EquiSplit. All rights reserved.
        </p>

        <div className="home-footer-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/login">Login</Link>
        </div>
      </footer>
    </div>
  );
}

export default Home;
