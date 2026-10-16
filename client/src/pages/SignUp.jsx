import AuthForm from "../components/AuthForm.jsx";

function SignUp({ onNavigate }) {
  return <AuthForm mode="signup" onNavigate={onNavigate} />;
}

export default SignUp;
