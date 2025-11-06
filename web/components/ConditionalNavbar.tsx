'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Hide navbar on login and signup pages
  const hideNavbar = pathname === '/login' || pathname === '/signup';
  
  if (hideNavbar) {
    return null;
  }
  
  return <Navbar />;
}

