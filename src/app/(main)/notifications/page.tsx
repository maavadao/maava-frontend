import { redirect } from 'next/navigation';

export default function NotificationsPage() {
  redirect('/marketplace?tab=notifications');
}
