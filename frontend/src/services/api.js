import axios from 'axios'
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', withCredentials: true, headers: { 'X-Requested-With': 'SmartLoan' } })
export const errorMessage = e => e.response?.data?.message || 'Unable to connect. Check that the API is running.'
export default api
