import { DefaultButton, FocusTrapZone, FontIcon, Layer, Overlay, Popup, PrimaryButton, Stack, mergeStyleSets, mergeStyles } from "@fluentui/react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import GPT_GUARD_LOGO from "../../assets/gpt_guard_logo.svg";
import styles from "./SideNav.module.css";
import { useContext, useEffect, useState } from "react";
import { Menu, menus } from "../../api";
import { AppStateContext } from "../../state/AppProvider";
import { useBoolean } from "@fluentui/react-hooks";

const SideNav = () => {
    const navigate = useNavigate();
    const [key, setKey] = useState<string | undefined>('/');
    const [color, setColor] = useState<string | undefined>('/');
    const [menu, setMenu] = useState<Menu[]>([]);
    const appStateContext = useContext(AppStateContext);
    const [isAPIFailed, { setTrue: showAPIError, setFalse: hidePopupAPIError }] = useBoolean(false);
    const [isAPIError, setAPIError] = useState<{
        isError: boolean,
        errorMessage?: string
    }>({
        isError: false,
        errorMessage: ''
    });

    const iconClass = mergeStyles({
        fontSize: 17,
    });

    const alertButtonStyles = mergeStyleSets({
        root: {
            background: '#5C6AE5',
        },
        rootHovered: {
            backgroundColor: '#5C6AE5',
        },
        rootPressed: {
            backgroundColor: '#5C6AE5',
        }
    })

    const popupStyles = mergeStyleSets({
        root: {
            background: 'rgba(0, 0, 0, 0.2)',
            bottom: '0',
            left: '0',
            position: 'fixed',
            right: '0',
            top: '0',
        },
        content: {
            background: 'white',
            left: '50%',
            maxWidth: '400px',
            padding: '0 2em 2em',
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
        },
    });

    useEffect(() => {
        getMenus();
    }, [])

    useEffect(() => {
        if (appStateContext?.state?.isLoggedIn) {
            getMenus();
        }
    }, [appStateContext?.state?.isLoggedIn])

    useEffect(() => {
        if (isAPIError?.isError) {
            showAPIError()
        }
    }, [isAPIError?.isError])

    const getMenus = async () => {
        await menus().then((response) => {
            if (response?.success) {
                setMenu(response.data)
                appStateContext?.dispatch({
                    type: "UPDATE_MENUS",
                    payload: {
                        data: response?.data
                    },
                });
                if (response?.data[0]?.key === 'privacy-filter') {
                    navigate("/")
                }
            }
            else {
                setMenu([])

                if (response?.error?.message) {
                    appStateContext?.dispatch({
                        type: "UPDATE_MENUS",
                        payload: {
                            error: response?.error?.message
                        },
                    });
                }
                if (!response?.error?.message) {
                    appStateContext?.dispatch({
                        type: "UPDATE_MENUS",
                        payload: {
                            error: "There was an issue in retrieving menus. Please try again"
                        },
                    });
                }
            }
        }).catch((err) => {
            appStateContext?.dispatch({
                type: "UPDATE_MENUS",
                payload: {
                    error: "There was an issue in retrieving menus. Please try again"
                },
            });
            setMenu([])
        })
    }

    function handleNoFilterKeySet() {
        navigate("no-filter")
        hidePopupAPIError()
    }

    function handleKeySet() {
        navigate("/")
        hidePopupAPIError()
    }

    const handleLinkChange = (_event: any, to: any) => {
        if (!appStateContext?.state?.uploadFile?.isFileUploaded) {
            appStateContext?.dispatch({ type: "CLEAR_FILE_UPLOAD" });
        }
        if (!appStateContext?.state?.publicUploadFile?.isFileUploaded) {
            appStateContext?.dispatch({ type: "PUBLIC_CLEAR_FILE_UPLOAD" });
        }
        if (to == '/') {
            if (appStateContext?.state?.publicCurrentChat?.id) {
                setKey('/')
            }
            else {
                setKey('/')
                navigate("/")
            }
        }
        if (to == 'no-filter') {
            if (appStateContext?.state?.currentChat?.id) {
                setKey('no-filter')
            }
            else {
                setKey('no-filter')
                navigate("no-filter")
            }
        }
    };

    const APIErrorMessageBar: React.FunctionComponent = () => {
        return (
            <>
                {isAPIFailed && (
                    <Layer>
                        <Popup
                            className={popupStyles.root}
                            role="dialog"
                            aria-modal="true"
                            onDismiss={hidePopupAPIError}
                            enableAriaHiddenSiblings={true}
                        >
                            <Overlay onClick={hidePopupAPIError} />
                            <FocusTrapZone>
                                <div role="document" className={popupStyles.content}>
                                    <div className={styles.fileInvalideContainer}>
                                        <h2>Alert </h2>
                                        <p>
                                            {
                                                isAPIError?.errorMessage
                                            }
                                        </p>
                                        <div className={styles.closebBtn}>
                                            <div className={styles.isOkBtn}>
                                                <PrimaryButton onClick={() => {
                                                    key === 'no-filter'
                                                        ? handleNoFilterKeySet()
                                                        : key === '/' ?
                                                            handleKeySet() : null
                                                }} styles={
                                                    alertButtonStyles
                                                }>OK</PrimaryButton>
                                            </div>
                                            <DefaultButton onClick={hidePopupAPIError}>Cancel</DefaultButton>
                                        </div>
                                    </div>
                                </div>
                            </FocusTrapZone>
                        </Popup>
                    </Layer>
                )}
            </>
        );
    };

    return (
        <>
            <div className={styles.container}>
                <div className={styles.leftContainer}>
                    <Stack horizontal verticalAlign="center" horizontalAlign="space-between"
                        className={styles.headerContainer}
                    >
                        <Stack horizontal verticalAlign="center">
                            <img
                                src={GPT_GUARD_LOGO}
                                className={styles.headerIcon}
                                aria-hidden="true"
                            />
                        </Stack>
                    </Stack>
                    <nav>
                        <ul style={{ listStyleType: 'none', padding: 0, fontSize: '16px', margin: '40px 0px 0px', }}>
                            {
                                menu && menu?.length > 0
                                    ? menu.map((data) => {
                                        return <li className={`${data?.link === color ? ' ' + styles.selectedMenu : styles.menu}`}>
                                            <FontIcon aria-label="Privacy" iconName={data?.icon} className={iconClass} />
                                            <NavLink to={data?.link}
                                                style={{
                                                    color: color == data?.link ? 'white' : 'black',
                                                    textDecoration: 'none',
                                                    display: 'block',
                                                    padding: '8px',
                                                    fontWeight: color == data?.link ? '600' : '500',
                                                    marginLeft: '8px'
                                                }}
                                                onClick={(e) => {
                                                    handleLinkChange(e, data?.link)
                                                    setColor(data?.link)
                                                }} >
                                                {data.name}
                                            </NavLink>
                                        </li>
                                    })
                                    : null
                            }
                        </ul>
                    </nav>
                </div>
                <div className={styles.rightContainer}>
                    <Outlet />
                </div>
            </div>
            {
                isAPIError?.isError
                    ? <APIErrorMessageBar />
                    : null
            }
        </>
    )
};

export default SideNav;
