
import React from 'react';
import { Navigate } from 'react-router-dom';

const Register: React.FC = () => {
  // Redireciona imediatamente para o login informando que o cadastro é desativado
  alert("O cadastro público foi desativado. Solicite suas credenciais ao Administrador.");
  return <Navigate to="/login" replace />;
};

export default Register;
