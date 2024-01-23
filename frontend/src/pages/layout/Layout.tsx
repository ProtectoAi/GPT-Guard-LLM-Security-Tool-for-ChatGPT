import { Outlet } from "react-router-dom";
import styles from "./Layout.module.css";
import { useContext, useEffect } from "react";
import { AppStateContext } from "../../state/AppProvider";

const Layout = () => {

    const appStateContext = useContext(AppStateContext);
    useEffect(() => { }, [appStateContext?.state.isPostgresDBAvailable.status]);

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
            </header>
            <Outlet />
        </div>
    );
};

export default Layout;
