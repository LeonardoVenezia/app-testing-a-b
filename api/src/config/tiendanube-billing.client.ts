import axios from "axios";
import { HttpErrorException } from "@utils";

export const tiendanubeBillingClient = axios.create({
  baseURL: process.env.TIENDANUBE_BILLING_API_URL,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": `${process.env.CLIENT_ID} (${process.env.CLIENT_EMAIL})`,
  },
});

tiendanubeBillingClient.interceptors.request.use(
  (config) => {
    // Partner-Action authentication uses the CLIENT_SECRET as a bearer token
    config.headers["Authentication"] = `bearer ${process.env.CLIENT_SECRET}`;
    return config;
  },
  function (error) {
    if (error.isAxiosError) {
      const { data } = error.response;
      const payload = new HttpErrorException(
        "TiendanubeBillingClient - " + data?.message,
        data?.description
      );
      payload.setStatusCode(data?.code);
      return Promise.reject(payload);
    }

    return Promise.reject(error);
  }
);

tiendanubeBillingClient.interceptors.response.use(
  (response) => {
    return response.data || {};
  },
  function (error) {
    if (error.isAxiosError) {
      const { data } = error.response;
      const payload = new HttpErrorException(
        "TiendanubeBillingClient - " + data?.message,
        data?.description
      );
      payload.setStatusCode(data?.code);
      return Promise.reject(payload);
    }

    return Promise.reject(error);
  }
);
