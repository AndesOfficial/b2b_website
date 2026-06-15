import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHostelAuth } from "../context/HostelAuthContext";
import { FiEye, FiEyeOff, FiMail, FiLock, FiLoader, FiPackage, FiBarChart2, FiUsers, FiShield } from "react-icons/fi";
import BrandLogo from "../components/Shared/BrandLogo";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { login, setAuthenticatedUser } = useHostelAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        const result = await login(email.trim(), password);

        if (result.success) {
            if (result.role === "admin" || result.role === "admin_viewer") {
                navigate("/admin");
            } else {
                navigate("/client/dashboard");
            }
        } else {
            setError(result.error || "Invalid email or password.");
        }
        setSubmitting(false);
    };

    return (
        <div className="min-h-screen flex" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {/* Left Panel */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#1976D2] via-[#1565C0] to-[#0D47A1] flex-col items-center justify-center p-12 relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute top-[-80px] left-[-80px] w-72 h-72 bg-white/10 rounded-full" />
                <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 bg-white/10 rounded-full" />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full" />

                <div className="relative z-10 text-center">
                    {/* Logo */}
                    <div className="flex items-center justify-center gap-3 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                            <BrandLogo className="w-10 h-10 text-[#1976D2]" />
                        </div>
                        <span className="text-white font-bold text-3xl tracking-tight">Andes</span>
                    </div>

                    <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
                        Welcome to<br />B2B Partner Portal
                    </h1>
                    <p className="text-white/80 text-lg max-w-xs mx-auto leading-relaxed">
                        Manage and track all your laundry orders in one place.
                    </p>

                    <div className="mt-12 grid grid-cols-2 gap-4 text-left">
                        {[
                            { icon: <FiPackage />, label: 'Order Tracking', desc: 'Real-time status' },
                            { icon: <FiBarChart2 />, label: 'Analytics', desc: 'Monthly insights' },
                            { icon: <FiUsers />, label: 'Multi-Tenant', desc: 'Tenant wise view' },
                            { icon: <FiShield />, label: 'Secure', desc: 'Private data only' },
                        ].map((f) => (
                            <div key={f.label} className="bg-white/10 rounded-xl p-4 hover:ring-1 hover:ring-white/50 hover:scale-[1.02] transition-all duration-200">
                                <span className="text-2xl mb-2 block">{f.icon}</span>
                                <p className="text-white font-semibold text-sm">{f.label}</p>
                                <p className="text-white/70 text-xs">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center bg-[radial-gradient(circle_at_top_right,_#DBEAFE_0%,_#F0F7FF_60%)] p-6">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
                        <BrandLogo className="w-10 h-10 text-[#1976D2]" />
                        <span className="font-bold text-[#1976D2] text-2xl">Andes B2B</span>
                    </div>

                    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-8">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
                            <p className="text-gray-500 text-sm mt-1">Access your partner dashboard</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                                <div className="relative">
                                    <FiMail size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="partner@example.com"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900
                      focus:border-2 focus:border-[#1976D2] focus:outline-none transition-all placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                                <div className="relative">
                                    <FiLock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type={showPass ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm text-gray-900
                      focus:border-2 focus:border-[#1976D2] focus:outline-none transition-all placeholder-gray-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(v => !v)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 bg-[#1976D2] hover:bg-[#1565C0] disabled:bg-[#1976D2] disabled:opacity-70
                  text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <><FiLoader size={18} className="animate-spin" /> Signing in...</>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>

                        <div className="flex justify-center mt-6">
                            <div className="inline-flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1 bg-white">
                                <FiLock size={12} className="text-gray-400" />
                                <span className="text-xs text-gray-400 font-medium tracking-wide">Secured by Andes Laundry · Partner Access Only</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
