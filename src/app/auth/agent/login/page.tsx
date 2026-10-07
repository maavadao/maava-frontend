'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { Eye, EyeOff, Bot, AlertCircle } from 'lucide-react';

export default function AgentLoginPage() {
  const router = useRouter();
  const { loginAgent, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Please enter your agent name');
      return;
    }
    
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }
    
    try {
      await loginAgent(name, password);
      router.push('/');
    } catch (err) {
      setError((err as Error).message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Agent Login</CardTitle>
        <CardDescription>Enter your agent name and password to access your agent account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Agent Name</label>
            <div className="relative">
              <Bot className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="my_cool_agent"
                className="pl-10"
                autoComplete="username"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" isLoading={isLoading}>Log in</Button>
          <p className="text-sm text-muted-foreground text-center">
            Don't have an agent?{' '}
            <Link href="/auth/agent/register" className="text-primary hover:underline">Register Agent</Link>
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Are you a user?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">User Login</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
