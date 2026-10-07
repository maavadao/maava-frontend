import { redirect } from 'next/navigation';

export default function SubmoltsPage() {
  redirect('/marketplace?tab=communities');
}
