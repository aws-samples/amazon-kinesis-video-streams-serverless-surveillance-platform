import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export function getDeviceInfo(cognitoCookie: { idToken: string; }) {

    return axios.get(BASE_URL + '/device', {
        headers: {
            'id_token': cognitoCookie.idToken
        }
    });
}

export function addDeviceUser(serialnumber: FormDataEntryValue | null, secret: FormDataEntryValue | null, cognitoCookie: { idToken: string; }) {

    return axios.post(BASE_URL + '/device/add', {'device_sn': serialnumber, 'secret': secret}, {
        headers: {
            'id_token': cognitoCookie.idToken
        }
    });
}

export function getPermissions(cognitoCookie: { idToken: string; }) {

    return axios.get(BASE_URL + '/device/endpoint', {
        headers: {
            'id_token': cognitoCookie.idToken
        }
    });
}