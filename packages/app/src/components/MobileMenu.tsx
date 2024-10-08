import NavElement from "./nav-element";
interface Props {
  children: React.ReactNode;
}

export const MobileMenu: React.FC<Props> = ({ children }) => {
  return (
    <div className="flex-1 drawer h-52">
      <input id="my-drawer" type="checkbox" className="grow drawer-toggle" />
      <div className="items-center  drawer-content">{children}</div>
      {/* SideBar / Drawer */}
      <div className="drawer-side">
        <label htmlFor="my-drawer" className="drawer-overlay gap-6"></label>

        <ul className="p-4 overflow-y-auto w-80 bg-shrub-blue gap-10 sm:flex items-center">
          <li className="pb-4">
            <NavElement label="Home" href="/" />
          </li>
          <li className="pb-4">
            <NavElement label="Dashboard" href="/dashboard" />
          </li>
          <li className="pb-4">
            {/*<NavElement*/}
            {/*  label="Deposit"*/}
            {/*  href="/deposit"*/}
            {/*/>*/}
          </li>
          <li className="pb-4">
            <NavElement label="Borrow" href="/borrow" />
          </li>
        </ul>
      </div>
    </div>
  );
};
