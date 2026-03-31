import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import Sidebar from './Sidebar';
import ProcurementSlider from './ProcurementSlider';
import { MenuIcon } from './Icons';

function Layout({ children }) {
  const location = useLocation();
  const { user, sidebarOpen, toggleSidebar, closeSidebar, loadProcurements, openLoginModal } = useStore();
  const isChatView = location.pathname.startsWith('/chat/');

  useEffect(() => {
    // Always load procurements so guests can browse and the slider is visible.
    // The login modal is shown only when there is no saved userId at all.
    loadProcurements();
    if (!user) {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        openLoginModal();
      }
    }
  }, [user, loadProcurements, openLoginModal]);

  return (
    <div className="app-container">
      <Sidebar />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}
      <main className="main-content">
        {!isChatView && (
          <header className="header mobile-header">
            <button
              className="btn btn-icon menu-toggle"
              aria-label="Menu"
              onClick={toggleSidebar}
            >
              <MenuIcon />
            </button>
            <h1 className="header-title">GroupBuy</h1>
          </header>
        )}
        <ProcurementSlider />
        {children}
      </main>
    </div>
  );
}

export default Layout;
