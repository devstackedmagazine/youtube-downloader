"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function ResetPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { resetPassword, error: authError } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm();
  
  const emailValue = watch("email");
  const defaultError = "Something went wrong. Please try again.";

  const onStep1Submit = async (data: any) => {
    setLoading(true);
    try {
      await resetPassword(data.email);
      setStep(2);
    } catch {
      // Ignore mock error here for flow
    } finally {
      setLoading(false);
    }
  };

  const onStep2Submit = async (data: any) => {
    setLoading(true);
    try {
      await resetPassword(emailValue, data.code);
      setStep(3);
    } catch {
      // Ignore mock
    } finally {
      setLoading(false);
    }
  };

  const onStep3Submit = async (data: any) => {
    setLoading(true);
    try {
      await resetPassword(emailValue, undefined, data.newPassword);
      window.location.href = "/auth/login?reset=success";
    } catch {
      // Ignore mock
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{" "}
          <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            return to login
          </Link>
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12 border border-gray-200">
          {authError && <p className="mb-6 text-sm text-red-600 bg-red-50 p-3 rounded-md font-medium">{authError}</p>}
          
          {step === 1 && (
            <form className="space-y-6" onSubmit={handleSubmit(onStep1Submit)}>
              <p className="text-sm text-gray-500 text-center mb-4">
                Enter the email associated with your account and we&apos;ll send you a resetting code.
              </p>
              <div>
                <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    type="email"
                    disabled={loading}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                    {...register("email", { 
                      required: "Email is required", 
                      pattern: { value: /^\S+@\S+$/i, message: "Invalid email address" } 
                    })}
                  />
                  {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message as string}</p>}
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70 flex items-center"
              >
                {loading ? "Sending..." : "Send reset code"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-6" onSubmit={handleSubmit(onStep2Submit)}>
              <p className="text-sm text-gray-500 text-center mb-4">
                We&apos;ve sent a code to <span className="font-semibold text-gray-900">{emailValue}</span>
              </p>
              <div>
                <label htmlFor="code" className="block text-sm font-medium leading-6 text-gray-900">
                  Verification Code
                </label>
                <div className="mt-2">
                  <input
                    id="code"
                    type="text"
                    disabled={loading}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 text-center tracking-widest text-lg font-bold"
                    {...register("code", { required: "Code is required", minLength: { value: 6, message: "Must be 6 characters"} })}
                  />
                  {errors.code && <p className="mt-2 text-sm text-red-600">{errors.code.message as string}</p>}
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70 flex items-center"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
            </form>
          )}

          {step === 3 && (
            <form className="space-y-6" onSubmit={handleSubmit(onStep3Submit)}>
              <p className="text-sm text-gray-500 text-center mb-4">
                Awesome! Now create a new password.
              </p>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium leading-6 text-gray-900">
                  New Password
                </label>
                <div className="mt-2">
                  <input
                    id="newPassword"
                    type="password"
                    disabled={loading}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                    {...register("newPassword", { 
                      required: "Password is required",
                      minLength: { value: 8, message: "Password must be at least 8 characters" },
                      pattern: { value: /^(?=.*[A-Z])(?=.*\d).*$/, message: "Must contain an uppercase letter and a number" }
                    })}
                  />
                  {errors.newPassword && <p className="mt-2 text-sm text-red-600">{errors.newPassword.message as string}</p>}
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70 flex items-center"
              >
                {loading ? "Saving..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
