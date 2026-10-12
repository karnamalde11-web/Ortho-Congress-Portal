import { login } from "../actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="card mx-auto max-w-md">
      <h1>Admin sign in</h1>
      {error && (
        <p role="alert">
          Sign-in failed or too many attempts. Please try again later.
        </p>
      )}
      <form action={login}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            maxLength={128}
          />
        </label>
        <button>Sign in</button>
      </form>
    </div>
  );
}
