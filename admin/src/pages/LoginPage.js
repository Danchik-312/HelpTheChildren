import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = 'Вход — Панель управления'; }, []);
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      const previousLocation = location.state?.from;
      const destination = previousLocation ? `${previousLocation.pathname}${previousLocation.search || ''}` : '/';
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brandMark} aria-hidden="true">Д</div>
        <p className={styles.eyebrow}>Администрирование сайта</p>
        <h1 id="login-title">Добро пожаловать</h1>
        <p className={styles.intro}>Войдите с рабочей учётной записью, чтобы управлять контентом.</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <label className={styles.field}>
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={submitting} />
          </label>
          <label className={styles.field}>
            <span>Пароль</span>
            <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} minLength="12" required disabled={submitting} />
          </label>
          <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? 'Входим…' : 'Войти'}</button>
        </form>
      </section>
    </main>
  );
}
