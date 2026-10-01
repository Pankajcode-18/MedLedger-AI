import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '../views/Home.vue'
import RegisterPatient from '../views/RegisterPatient.vue'
import RegisterDoctor from '../views/RegisterDoctor.vue'
import LoginPatient from '../views/LoginPatient.vue'
import LoginDoctor from '../views/LoginDoctor.vue'
import LoginHospitalAdmin from '../views/LoginHospitalAdmin.vue'
import Login from '../views/Login.vue'
import PatientDashboard from '../views/PatientDashboard.vue'
import DoctorDashboard from '../views/DoctorDashboard.vue'
import HospitalAdminDashboard from '../views/HospitalAdminDashboard.vue'
import HospitalDashboard from '../views/HospitalDashboard.vue'
import LabDashboard from '../views/LabDashboard.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import InsuranceDashboard from '../views/InsuranceDashboard.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/Login',
    name: 'Login',
    component: Login
  },
  {
    path: '/InsuranceDashboard',
    name: 'InsuranceDashboard',
    component: InsuranceDashboard
  },
  {
    path: '/HospitalDashboard',
    name: 'HospitalDashboard',
    component: HospitalDashboard
  },
  {
    path: '/LabDashboard',
    name: 'LabDashboard',
    component: LabDashboard
  },
  {
    path: '/AdminDashboard',
    name: 'AdminDashboard',
    component: AdminDashboard
  },
  {
    path: '/HospitalAdminDashboard',
    name: 'HospitalAdminDashboard',
    component: HospitalAdminDashboard
  },
  {
    path: '/DoctorDashboard',
    name: 'DoctorDashboard',
    component: DoctorDashboard
  },
  {
    path: '/PatientDashboard',
    name: 'PatientDashboard',
    component: PatientDashboard
  },
  {
    path: '/LoginHospitalAdmin',
    name: 'LoginHospitalAdmin',
    component: LoginHospitalAdmin
  },
  {
    path: '/LoginDoctor',
    name: 'LoginDoctor',
    component: LoginDoctor
  },
  {
    path: '/LoginPatient',
    name: 'LoginPatient',
    component: LoginPatient
  },
  {
    path: '/RegisterPatient',
    name: 'RegisterPatient',
    component: RegisterPatient
  },
  {
    path: '/RegisterDoctor',
    name: 'RegisterDoctor',
    component: RegisterDoctor
  },
  {
    path: '/about',
    name: 'About',
    component: () => import(/* webpackChunkName: "about" */ '../views/About.vue')
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
