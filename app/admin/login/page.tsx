import { redirect } from 'next/navigation'

export default function AdminLogin() {
  redirect('/login?redirectTo=/admin')
}
