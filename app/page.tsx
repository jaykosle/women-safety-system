'use client'
import { useAuth } from '@/context/AuthContext';
import React from 'react';
import Link from 'next/link';
import { Shield, Map, Navigation, Bell, BarChart, AlertTriangle, HeartHandshake } from 'lucide-react';
import StateCrimeChart from '@/components/Landing Page Components/StateCrimeChart';
import CrimeTrendChart from '@/components/Landing Page Components/CrimeTrendChart';
import CrimePieChart from '@/components/Landing Page Components/CrimePieChart';

export default function LandingPage() {
  const { user, loading, logout } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <Shield className="w-8 h-8 text-rose-600" />
          <span className="text-xl font-bold text-slate-800">SafePath<span className="text-rose-500"> AI</span></span>
        </div>
        <div>
<div className="flex items-center space-x-3">
  {!loading && (
    user ? (
      <>
        <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Dashboard
        </Link>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors"
        >
          Logout
        </button>
      </>
    ) : (
      <>
        <Link href="/login" className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50">
          Login
        </Link>
        <Link href="/signup" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors">
          Sign Up
        </Link>
      </>
    )
  )}
</div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-8 py-20 bg-white text-center">
        <div className="max-w-4xl mx-auto">
          <HeartHandshake className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
            Empowering Women with AI-Driven Safety
          </h1>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            Every woman deserves the right to navigate the world without fear. We are building a real-time, intelligent platform that predicts safety risks, recommends secure routes, and provides immediate emergency support. Technology can't solve everything, but together, we can create a tangible, real-life impact.
          </p>
          <div className="flex justify-center space-x-4">
            <button className="px-8 py-3 text-lg font-medium text-white bg-rose-600 rounded-md hover:bg-rose-700 transition-colors shadow-lg">
              Get Protected Today
            </button>
            <button className="px-8 py-3 text-lg font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">
              Learn How It Works
            </button>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="px-8 py-20 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">The Reality We Are Changing</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              The data from 2001 to 2021 highlights the urgent need for proactive safety measures[cite: 8, 9]. Our mission is to reverse these trends.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
              <div className="text-5xl font-extrabold text-rose-500 mb-2">5M+</div>
              <p className="text-slate-300 font-medium">Overall Crimes Recorded [cite: 20, 21]</p>
            </div>
            <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
              <div className="text-5xl font-extrabold text-indigo-400 mb-2">39.2%</div>
              <p className="text-slate-300 font-medium">Cases of Domestic Violence </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
              <div className="text-5xl font-extrabold text-amber-400 mb-2">23.8%</div>
              <p className="text-slate-300 font-medium">Cases of Assault on Women [cite: 14, 25]</p>
            </div>
          </div>
          
          <div className="mt-12 text-center text-slate-400 text-sm">
            <p>States with the highest incident rates include Uttar Pradesh, Madhya Pradesh, and West Bengal[cite: 41, 42, 43]. Our ML models prioritize risk analysis in vulnerable regions.</p>
          </div>
        </div>
      </section>



      {/* Analytics Preview Section */}
      <section className="px-8 py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Data-Driven Awareness</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              By understanding historical patterns and incident hotspots, our machine learning algorithms dynamically assess safety risks in real-time.
            </p>
          </div>
          
          {/* Grid Layout for Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Top Row: Trend Chart spans full width on small screens, 2/3 on large screens */}
            <div className="lg:col-span-2">
              <CrimeTrendChart />
            </div>

            {/* Top Row: Pie chart takes the remaining 1/3 */}
            <div className="lg:col-span-1">
              <CrimePieChart />
            </div>

            {/* Bottom Row: State Bar Chart spans the full width */}
            <div className="lg:col-span-3">
              <StateCrimeChart />
            </div>
            
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-8 py-24 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Comprehensive Safety Ecosystem</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Our platform utilizes state-of-the-art machine learning and geospatial data to keep you informed and protected.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-slate-50 rounded-2xl hover:shadow-lg transition-shadow border border-slate-100">
              <AlertTriangle className="w-12 h-12 text-amber-500 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 mb-3">AI Risk Prediction</h3>
              <p className="text-slate-600">
                Our FastAPI machine learning backend analyzes historical crime data to generate real-time risk scores (0-100) for any location.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 bg-slate-50 rounded-2xl hover:shadow-lg transition-shadow border border-slate-100">
              <Map className="w-12 h-12 text-indigo-500 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 mb-3">Safety Heatmaps</h3>
              <p className="text-slate-600">
                Interactive Leaflet.js maps displaying color-coded risk levels, allowing you to visually assess neighborhood safety at a glance.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 bg-slate-50 rounded-2xl hover:shadow-lg transition-shadow border border-slate-100">
              <Navigation className="w-12 h-12 text-emerald-500 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 mb-3">Safe Route Routing</h3>
              <p className="text-slate-600">
                Smart navigation that calculates paths by minimizing a combined cost of distance and predicted safety risks.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 bg-slate-50 rounded-2xl hover:shadow-lg transition-shadow border border-slate-100">
              <Bell className="w-12 h-12 text-rose-500 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 mb-3">SOS Emergency Alerts</h3>
              <p className="text-slate-600">
                One-tap emergency system that instantly broadcasts your live location and risk status to trusted contacts and local authorities.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-8 bg-slate-50 rounded-2xl hover:shadow-lg transition-shadow border border-slate-100 lg:col-span-2">
              <BarChart className="w-12 h-12 text-blue-500 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 mb-3">Admin Safety Analytics</h3>
              <p className="text-slate-600">
                A secure dashboard powered by PostgreSQL and Prisma for authorities to monitor crime trends, identify hotspots, and respond to emergency alerts effectively.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-8 text-center">
        <p>© 2026 SafePath AI Project. Dedicated to building a safer world.</p>
      </footer>
    </div>
  );
}