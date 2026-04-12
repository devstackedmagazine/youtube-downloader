"use client";

import { useForm } from "react-hook-form";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const { register, handleSubmit, formState: { errors }, watch } = useForm();
  const { signup, error: authError, isLoading } = useAuth();
  
  const passwordValue = watch("password");

  const onSubmit = async (data: any) => {
    try {
      await signup(data.email, data.password);
    } catch {
      // Errors handled by context
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Create an account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12 border border-gray-200">
          {authError && <p className="mb-6 text-sm text-red-600 bg-red-50 p-3 rounded-md font-medium">{authError}</p>}
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  type="email"
                  disabled={isLoading}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                  {...register("email", { 
                    required: "Email is required", 
                    pattern: { value: /^\S+@\S+$/i, message: "Invalid email address" } 
                  })}
                />
                {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message as string}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                Password
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  type="password"
                  disabled={isLoading}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                  {...register("password", { 
                    required: "Password is required",
                    minLength: { value: 8, message: "Must be at least 8 characters" },
                    pattern: { value: /^(?=.*[A-Z])(?=.*\d).*$/, message: "Must contain an uppercase letter and a number" }
                  })}
                />
                {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message as string}</p>}
              </div>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6 text-gray-900">
                Confirm Password
              </label>
              <div className="mt-2">
                <input
                  id="confirmPassword"
                  type="password"
                  disabled={isLoading}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                  {...register("confirmPassword", { 
                    required: "Please confirm your password",
                    validate: value => value === passwordValue || "Passwords do not match"
                  })}
                />
                {errors.confirmPassword && <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message as string}</p>}
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="terms"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                {...register("terms", { required: "You must accept the terms" })}
              />
              <label htmlFor="terms" className="ml-3 block text-sm leading-6 text-gray-900">
                I accept the {" "}
                <Link href="#" className="font-semibold text-indigo-600 hover:text-indigo-500">
                  Terms and Conditions
                </Link>
              </label>
            </div>
            {errors.terms && <p className="mt-1 text-sm text-red-600">{errors.terms.message as string}</p>}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70"
              >
                {isLoading ? "Creating account..." : "Sign up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
