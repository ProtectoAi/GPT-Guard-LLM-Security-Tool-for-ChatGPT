
export const loginRequest = {
  scopes: ["User.read", "openid", "profile", "offline_access"],
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me"
};

const DB_VALUE = import.meta.env.VITE_IS_DB_AVAILABLE;
const DB = DB_VALUE && DB_VALUE.length !== 0 && DB_VALUE !== undefined && DB_VALUE !== null ? DB_VALUE.toLowerCase() : null
export const IS_DB_AVAILABLE = DB !== null && DB === "true" ? true : false

