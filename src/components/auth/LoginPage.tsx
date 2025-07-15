import React, { useState } from 'react';
import './LoginPage.css';

interface LoginFormData {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      // Aqui você adicionaria a lógica para autenticar o usuário
      console.log('Tentando login com:', formData);
      
      // Exemplo de redirecionamento após o login bem-sucedido
      // window.location.href = '/dashboard';
    } catch (err) {
      setError('Falha ao fazer login. Por favor, verifique suas credenciais.');
      console.error('Erro de login:', err);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-wrapper">
        <div className="login-form-container">
          <h1>Bem-vindo de volta</h1>
          <p className="login-subtitle">Entre com sua conta para continuar</p>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Seu email"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Sua senha"
              />
            </div>
            
            <div className="form-footer">
              <div className="remember-me">
                <input type="checkbox" id="remember" />
                <label htmlFor="remember">Lembrar-me</label>
              </div>
              <a href="/forgot-password" className="forgot-password">
                Esqueceu a senha?
              </a>
            </div>
            
            <button type="submit" className="login-button">
              Entrar
            </button>
          </form>
          
          <div className="register-prompt">
            Não tem uma conta? <a href="/register">Cadastre-se</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 