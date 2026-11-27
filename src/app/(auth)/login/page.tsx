"use client";

import Logo from "@/components/ui/Logo";
import React, { useState } from "react";
import { Form, Input, Alert, message } from "antd";
import { UserIcon, LockPasswordIcon } from "@solar-icons/react/linear";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const onFinish = async (values: any) => {
    setLoading(true);
    setErrorMsg("");
    
    const { email, password } = values;
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      message.success("Connexion réussie !");
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-sunken rounded-xl flex items-center justify-center shadow-sm border border-border">
            <span className="inline-flex [[data-theme=dark]_&]:hidden">
              <Logo variant="symbol" size="sm" tone="on-light" className="w-[32px]" />
            </span>
            <span className="hidden [[data-theme=dark]_&]:inline-flex">
              <Logo variant="symbol" size="sm" tone="on-dark" className="w-[32px]" />
            </span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-[28px] font-bold font-title text-foreground tracking-tight">
          Bon retour
        </h2>
        <p className="mt-2 text-center text-[15px] text-muted font-sans">
          Connectez-vous pour accéder à vos outils.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-4 shadow-md sm:rounded-2xl sm:px-10 border border-border">
          
          {errorMsg && (
            <Alert 
              message={errorMsg} 
              type="error" 
              showIcon 
              className="mb-6 rounded-xl font-medium" 
            />
          )}

          <Form
            name="login"
            layout="vertical"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            size="large"
            requiredMark={false}
          >
            <Form.Item
              label={<span className="text-foreground font-semibold text-sm">Adresse email</span>}
              name="email"
              rules={[{ required: true, message: 'Veuillez renseigner votre email' }, { type: 'email', message: 'Email invalide' }]}
            >
              <Input 
                prefix={<UserIcon className="w-4 h-4 text-muted mr-1" />} 
                placeholder="vous@exemple.com" 
                className="rounded-lg transition-colors"
              />
            </Form.Item>

            <Form.Item
              className="[&_.ant-form-item-label>label]:w-full"
              label={
                <div className="flex justify-between w-full items-center gap-4">
                  <span className="text-foreground font-semibold text-sm">Mot de passe</span>
                  <a href="#" className="text-sm font-semibold text-t-brand hover:underline transition-colors">
                    Oublié ?
                  </a>
                </div>
              }
              name="password"
              rules={[{ required: true, message: 'Veuillez renseigner votre mot de passe' }]}
            >
              <Input.Password
                prefix={<LockPasswordIcon className="w-4 h-4 text-muted mr-1" />}
                placeholder="Votre mot de passe"
                className="rounded-lg transition-colors"
              />
            </Form.Item>

            <Form.Item className="mt-8 mb-0">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full flex justify-center items-center h-[48px] text-[15.5px] font-bold bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action rounded-lg shadow-sm hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : null}
                Se connecter
              </button>
            </Form.Item>
          </Form>

          <div className="mt-8 text-center text-sm text-muted font-medium">
            Vous n&apos;avez pas encore d&apos;accès ?{' '}
            <Link href="/register" className="font-semibold text-t-brand hover:underline transition-colors">
              Rejoindre la liste d&apos;attente
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
