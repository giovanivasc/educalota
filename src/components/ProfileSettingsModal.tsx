import React, { useState, useRef } from 'react';
import { User, UserRole } from '../types';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
    isOpen,
    onClose,
    user,
    onUpdateUser
}) => {
    const [name, setName] = useState(user.name);
    // Role agora é editável. Note que em sistemas reais, autol-alteração de role deve ser checada no backend.
    const [role, setRole] = useState<string>(user.role || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Avatar upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar || null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const updates: any = {};

            // Password update logic
            if (password) {
                if (password !== confirmPassword) {
                    throw new Error("As senhas não coincidem.");
                }
                if (password.length < 6) {
                    throw new Error("A senha deve ter pelo menos 6 caracteres.");
                }
                const { error: pwdError } = await supabase.auth.updateUser({ password: password });
                if (pwdError) throw pwdError;
                updates.passwordUpdated = true;
            }

            // Avatar upload logic
            let avatarUrl = user.avatar;
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `${user.id}-${Math.random()}.${fileExt}`;
                const filePath = `${fileName}`;

                // Tenta fazer upload para o bucket 'avatars'. 
                // Se o bucket não existir ou permissões falharem, isso lançará erro.
                // Assumindo bucket público 'avatars' ou similar.
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile);

                if (uploadError) {
                    // Fallback visual se storage falhar (apenas erro de log, não bloqueia user update)
                    console.error("Erro ao fazer upload da imagem:", uploadError);
                    // Opcional: throw uploadError se quiser bloquear
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(filePath);
                    avatarUrl = publicUrl;
                }
            }

            // Metadata update (Name, Role, Avatar)
            const { error: metaError } = await supabase.auth.updateUser({
                data: {
                    full_name: name,
                    role: role,
                    avatar_url: avatarUrl
                }
            });

            if (metaError) throw metaError;

            // Updates local state
            onUpdateUser({
                name,
                role: role as UserRole,
                avatar: avatarUrl
            });

            setSuccess("Perfil atualizado com sucesso!");

            // Clear passwords
            setPassword('');
            setConfirmPassword('');

            // Close after brief delay on success
            setTimeout(() => {
                onClose();
                setSuccess(null);
            }, 1500);

        } catch (err: any) {
            setError(err.message || "Erro ao atualizar perfil.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-primary/5">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">manage_accounts</span>
                        Editar Perfil
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSave} className="space-y-6">

                        {/* Avatar Section */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-lg bg-slate-100">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                            <span className="material-symbols-outlined text-4xl">person</span>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="material-symbols-outlined text-white">photo_camera</span>
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                            />
                            <p className="text-sm text-slate-500">Clique para alterar a foto</p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                                <span className="material-symbols-outlined text-base">error</span>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100 flex items-start gap-2">
                                <span className="material-symbols-outlined text-base">check_circle</span>
                                {success}
                            </div>
                        )}

                        {/* Fields */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nome Completo</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder="Seu nome"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cargo / Função</label>
                                <input
                                    type="text"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder="Ex: Diretor, Coordenador"
                                />
                                <p className="text-xs text-slate-400">Isso define sua função exibida no sistema.</p>
                            </div>

                            <div className="space-y-1 opacity-60 cursor-not-allowed">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">E-mail</label>
                                <input
                                    type="email"
                                    value={user.email}
                                    disabled
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 outline-none text-slate-500"
                                />
                                <p className="text-xs text-slate-400">O e-mail não pode ser alterado.</p>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-400">lock</span>
                                    Alterar Senha
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nova Senha</label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            placeholder="••••••"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Confirmar Senha</label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            placeholder="••••••"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                isLoading={loading}
                            >
                                Salvar Alterações
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
