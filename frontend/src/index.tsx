import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { initializeIcons } from "@fluentui/react";

import Layout from "./pages/layout/Layout";
import NoPage from "./pages/NoPage";
import Chat from "./pages/chat/Chat";
import { AppStateProvider } from "./state/AppProvider";
import SideNav from "./pages/sidenav/SideNav";
import Public from "./pages/public/Public";
import "./index.css";

initializeIcons();

export default function App() {
    return (
        <AppStateProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route path="/" element={<SideNav />}>
                            <Route index element={<Chat />} />
                            <Route path="no-filter" element={<Public />} />
                            <Route path="*" element={<NoPage />} />
                        </Route>
                    </Route>
                </Routes>
            </Router>
        </AppStateProvider>
    );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    // <React.StrictMode>
    //     <App />
    // </React.StrictMode>
    <App />
);


