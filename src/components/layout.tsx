import { Outlet } from 'react-router-dom';
import NavBar from './navbar';

export const Layout: React.FC = () => {
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
};