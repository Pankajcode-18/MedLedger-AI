<template>
  <div class="patient-dashboard-view">
    <LoginnPatient />
  </div>
</template>

<script>
import LoginnPatient from '../components/LoginnPatient.vue';

export default {
  name: 'PatientDashboard',
  components: {
    LoginnPatient
  }
};
</script>
