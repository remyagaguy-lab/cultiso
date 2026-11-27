"use client";

import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Result } from "antd";
import { UserIcon, LetterIcon } from "@solar-icons/react/linear";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const supabase = createClient();
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    setErrorMsg("");
    
    const { email, nom, projet } = values;
    
    // Insertion dans la table waitlist
    
    const { error } = await (supabase as any).from('waitlist').insert([
      { 
        email: email, 
        full_name: nom, 
        project_description: projet 
      }
    ]);

    if (error) {
      if (error.code === '23505') {
        setErrorMsg("Cette adresse email est déjà sur la liste d'attente.");
      } else {
        setErrorMsg("Une erreur est survenue lors de l'envoi. Réessayez plus tard.");
      }
      setLoading(false);
    } else {
      setIsSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-md rounded-2xl border border-border overflow-hidden" styles={{ body: { padding: '40px 32px' } }}>
          
          {isSubmitted ? (
            <Result
              status="success"
              title={<span className="font-title text-foreground">Demande envoyée !</span>}
              subTitle={<span className="font-sans text-muted">Merci pour votre intérêt. Cultiso est actuellement en Bêta privée. Notre équipe examinera votre profil et vous enverra une invitation très prochainement.</span>}
              extra={[
                <Link href="/" key="home">
                  <Button type="primary" size="large" className="w-full font-bold shadow-sm rounded-lg">
                    Retour à l&apos;accueil
                  </Button>
                </Link>
              ]}
            />
          ) : (
            <>
              <div className="text-center mb-8">
                <Title level={2} className="!mb-2 !text-foreground !font-title">
                  Bienvenue sur Cultiso
                </Title>
                <Text className="text-muted text-base">
                  Cultiso est actuellement en version bêta privée. Inscrivez-vous pour obtenir un accès privilégié et faire partie de nos premiers testeurs !
                </Text>
              </div>

              {errorMsg && (
                <Alert message={errorMsg} type="error" showIcon className="mb-6 rounded-lg" />
              )}

              <Form
                form={form}
                name="waitlist"
                layout="vertical"
                onFinish={onFinish}
                size="large"
                requiredMark={false}
              >
                <Form.Item
                  label={<span className="font-semibold text-foreground">Nom complet</span>}
                  name="nom"
                  rules={[{ required: true, message: 'Veuillez renseigner votre nom' }]}
                >
                  <Input 
                    prefix={<UserIcon className="w-4 h-4 text-muted" />} 
                    placeholder="Ex: Jean Dupont" 
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="font-semibold text-foreground">Adresse e-mail</span>}
                  name="email"
                  rules={[{ required: true, message: 'Veuillez renseigner votre email' }, { type: 'email', message: 'Email invalide' }]}
                >
                  <Input 
                    prefix={<LetterIcon className="w-4 h-4 text-muted" />} 
                    placeholder="jean@agrobusiness.com" 
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="font-semibold text-foreground">Parlez-nous de votre projet (Optionnel)</span>}
                  name="projet"
                >
                  <TextArea 
                    placeholder="Ex: Je lance une exploitation de maïs sur 5 hectares..." 
                    autoSize={{ minRows: 3, maxRows: 5 }}
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item className="mb-0 mt-8">
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    className="w-full !h-[48px] text-[16px] font-bold tracking-wide shadow-sm rounded-lg"
                    loading={loading}
                  >
                    Demander mon accès anticipé
                  </Button>
                </Form.Item>
              </Form>

              <div className="mt-8 text-center text-muted text-sm">
                Déjà membre ou invité ?{' '}
                <Link href="/login" className="text-t-action hover:underline font-semibold transition-colors">
                  Se connecter
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}





