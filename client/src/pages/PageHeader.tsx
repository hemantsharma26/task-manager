import { NavLink, useLocation } from 'react-router-dom';
import { prefetchListPage } from './lazy';

export function PageHeader({ title }: { title: string }) {
  const { search } = useLocation();
  return (
    <div className="page-head">
      <p className="crumbs">Projects / My tasks</p>
      <h1>{title}</h1>
      <nav className="tabs" aria-label="View">
        <NavLink to={{ pathname: '/board', search }} className="tab">
          Board
        </NavLink>
        <NavLink to={{ pathname: '/list', search }} className="tab" onMouseEnter={prefetchListPage} onFocus={prefetchListPage}>
          List
        </NavLink>
      </nav>
    </div>
  );
}
