import AuthForm from "../components/AuthForm.jsx";

function Login({ onNavigate }) {
  return <AuthForm mode="login" onNavigate={onNavigate} />;
}

export default Login;
