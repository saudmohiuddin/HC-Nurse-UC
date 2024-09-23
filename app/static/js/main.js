$(document).ready(function() {
    fetchNurses();
    fetchPatients();

    let isAddingNewPatient = false;
    const $mainActionButton = $('#mainActionButton');
    const $patientInfoFields = $('#patientInfoFields');

    // Hide patient info fields on initial load
    $('#patientInfoFields').hide();

    $('#nurseSelect').change(function() {
        const selectedNurseId = $(this).val();
        if (this.value === "add_new") {
            $('#newNurseFields').show();
        } else {
            $('#newNurseFields').hide();
        }
        $('#selectedNurseId').val(selectedNurseId);

        fetchPatientRecordings;
    });

    $('#addNurseButton').off('click').on('click', function(event) {
        event.preventDefault();
        addNurse();
    });

    $('#patientSelect').change(function() {
        if (this.value === 'add_new') {
            isAddingNewPatient = true;
            $('#newPatientFields').show().addClass('highlight-required');
            $('#newPatientFields input').val('').addClass('invalid');
            $('#patientInfoFields').hide();
            $mainActionButton.text('Add Patient');
        } else if (this.value) {
            isAddingNewPatient = false;
            $('#newPatientFields').hide().removeClass('highlight-required');
            $('#patientInfoFields').show();
            $mainActionButton.text('Submit Form');
            populatePatientInfo(this.value);
        } else {
            // No patient selected
            isAddingNewPatient = false;
            $('#newPatientFields').hide().removeClass('highlight-required');
            $('#patientInfoFields').hide();
            $('#newPatientFields input').val('');
            $mainActionButton.text('Submit Form');
        }

        fetchPatientRecordings;
    });

    // Add this new event handler
    $('#newPatientFields').on('input', '.required-field', function() {
        if ($(this).val() !== '') {
            $(this).removeClass('invalid');
        } else {
            $(this).addClass('invalid');
        }
    });

    $('#newPatientFields').on('input', '.required-field', function() {
        if ($(this).val().trim() !== '') {
            $(this).removeClass('invalid');
        } else {
            $(this).addClass('invalid');
        }
    });

    $mainActionButton.click(function(e) {
        e.preventDefault();
        if (isAddingNewPatient) {
            addNewPatient();
        } else {
            submitForm();
        }
    });

    function fetchNurses() {
        $.ajax({
            url: '/get_nurses',
            method: 'GET',
            success: function(data) {
                $('#nurseSelect').html('<option value="">--Select Nurse--</option><option value="add_new">Add New Nurse</option>');
                data.nurses.forEach(function(nurse) {
                    $('#nurseSelect').append($('<option>', {
                        value: nurse.nurse_id,
                        text: `${nurse.first_name} ${nurse.last_name}`
                    }));
                });
                $('#nurseSelect').prop('disabled', false);
            },
            error: function(xhr, status, error) {
                console.error('Error fetching nurses:', error);
            }
        });
    }    

    function fetchPatients() {
        $.ajax({
            url: '/get_patients',
            method: 'GET',
            success: function(data) {
                $('#patientSelect').html('<option value="">--Select Patient--</option><option value="add_new">Add New Patient</option>');
                data.forEach(function(patient) {
                    $('#patientSelect').append($('<option>', {
                        value: patient._id,  // Use the patient ID as the value
                        text: patient.name   // Display only the name
                    }));
                });
                $('#patientSelect').prop('disabled', false);
            },
            error: function(xhr, status, error) {
                console.error('Error fetching patients:', error);
            }
        });
    }

    function addNurse() {
        const firstName = $('#nurse_first_name').val().trim();
        const lastName = $('#nurse_last_name').val().trim();

        if (!firstName || !lastName) {
            alert('Please fill in both First Name and Last Name');
            return;
        }

        $('#addNurseButton').prop('disabled', true);

        const nurseData = {
            first_name: firstName,
            last_name: lastName
        };

        $.ajax({
            url: '/add_nurse',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(nurseData),
            success: function(data) {
                if (data.status === 'success') {
                    alert('Nurse added successfully');
                    fetchNurses();
                    $('#newNurseFields').hide();
                    $('#nurse_first_name').val('');
                    $('#nurse_last_name').val('');
                } else {
                    alert(data.message);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error:', error);
                alert('Error adding nurse. Please try again.');
            },
            complete: function() {
                $('#addNurseButton').prop('disabled', false);
            }
        });
    }

    function addNewPatient() {
        const name = $('#newPatientFields #patient_name').val().trim();
        const dob = $('#newPatientFields #patient_dob').val();
        const medicalHistory = $('#newPatientFields #patient_medical_history').val().trim();

        let isValid = true;
        $('#newPatientFields .required-field').each(function() {
            if ($(this).val().trim() === '') {
                $(this).addClass('invalid');
                isValid = false;
            } else {
                $(this).removeClass('invalid');
            }
        });
           if (!isValid) {
            alert('Please fill in all required fields.');
            return;
        }    

        const patientData = { name, dob, medical_history: medicalHistory };

        $.ajax({
            url: '/add_patient',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(patientData),
            success: function(response) {
                if (response.status === 'success') {
                    alert('Patient added successfully');
                    fetchPatients();
                    $('#newPatientFields').hide().removeClass('highlight-required');
                    $mainActionButton.text('Submit Form');
                    isAddingNewPatient = false;
                    $('#patientSelect').val(response.patient_id).trigger('change');
                    // Optionally, you can populate the patient info fields here
                    $('#displayPatientMRN').val(response.mrn);
                    // Age will be calculated on the server side when fetching patient details
                } else {
                    alert('Error adding patient: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                alert('Error adding patient. Please try again.');
            }
        });
    }

    function submitForm() {
        const selectedPatientId = $('#patientSelect').val();
        const selectedNurseId = $('#nurseSelect').val();
        const selectedShift = $('input[name="shift"]:checked').val();
        
        if (!selectedPatientId || selectedPatientId === 'add_new' || !selectedNurseId) {
            alert('Please select both a patient and a nurse before submitting the form.');
            return;
        }
    
        if (!selectedShift) {
            alert('Please select AM or PM shift before submitting the form.');
            return;
        }

        const formData = {
            patient_id: selectedPatientId,
            nurse_id: selectedNurseId,
            shift: selectedShift,
            responses: [],
            medications: [],
            recordings: []
        };
    
        // Collect form data
        $('#healthForm').find('input, select, textarea').each(function() {
            const $this = $(this);
            const name = $this.attr('name');
            const value = $this.val();
    
            if (name && value) {
                if (name.startsWith('response_')) {
                    if ($this.is(':radio') || $this.is(':checkbox')) {
                        if ($this.is(':checked')) {
                            formData.responses.push({
                                question: name.replace('response_', ''),
                                answer: value
                            });
                        }
                    } else {
                        formData.responses.push({
                            question: name.replace('response_', ''),
                            answer: value
                        });
                    }
                } else if (name.startsWith('medication_')) {
                    if ($this.is(':checked')) {
                        formData.medications.push({
                            name: name.replace('medication_', ''),
                            administered: true
                        });
                    }
                }
            }
        });
    
        $('.transcription-container').each(function() {
            const recording = {
                timestamp: $(this).find('.timestamp').text(),
                transcription: $(this).find('.verbatim-text').text(),
                summary: $(this).find('.summary-text').text()
            };
            formData.recordings.push(recording);
        });
        
        console.log('Form data being sent:', formData);
    
        $.ajax({
            url: '/submit_form',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(data) {
                if (data.status === 'success') {
                    alert('Form submitted successfully for ' + selectedShift + ' shift');
                    clearFormFields(); // Clear form fields after successful submission
                } else {
                    alert('Error submitting form: ' + data.message);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error:', error);
                alert('Error submitting form. Please try again.');
            }
        });
    }

    function clearFormFields() {
        // Clear response fields
        $('#healthForm').find('input[type="text"], textarea').val('');
        $('#healthForm').find('input[type="radio"], input[type="checkbox"]').prop('checked', false);
        
        // Clear medication checkboxes
        $('#healthForm').find('input[name^="medication_"]').prop('checked', false);
        
        // Reset select elements to their default option
        $('#healthForm').find('select').prop('selectedIndex', 0);
        
        // Clear pain level radio buttons
        $('input[name="pain_level"]').prop('checked', false);
        
        // Clear other specific fields if needed
        $('#displayPatientMRN, #displayPatientAge, #displayPatientMedicalHistory').val('');
    }

    function populatePatientInfo(patientId) {
        $.ajax({
            url: `/get_patient/${patientId}`,
            method: 'GET',
            success: function(patient) {
                $('#displayPatientMRN').val(patient.mrn);  // Display MRN instead of name
                $('#displayPatientAge').val(patient.age);  // Display age instead of DOB
                $('#displayPatientMedicalHistory').val(patient.medical_history);
                $('#patientInfoFields').show();
            },
            error: function(xhr, status, error) {
                console.error('Error fetching patient info:', error);
                alert('Error fetching patient information. Please try again.');
            }
        });
    }

    function checkAndShowGenerateButton() {
        const selectedPatientId = $('#patientSelect').val();
        const selectedNurseId = $('#nurseSelect').val();

        if (selectedPatientId && selectedPatientId !== 'add_new' && 
            selectedNurseId && selectedNurseId !== 'add_new') {
            $.ajax({
                url: '/get_transcription_count',
                method: 'GET',
                data: {
                    patient_id: selectedPatientId,
                    nurse_id: selectedNurseId
                },
                success: function(response) {
                    if (response.count >= 2) {
                        $('#generateSummaryBtn').show();
                    } else {
                        $('#generateSummaryBtn').hide();
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching transcription count:', error);
                    $('#generateSummaryBtn').hide();
                }
            });
        } else {
            $('#generateSummaryBtn').hide();
        }
    }

    $('#patientSelect, #nurseSelect').change(function() {
        checkAndShowGenerateButton();
        fetchLatestSummary();
        if (typeof window.fetchPatientRecordings === 'function') {
            window.fetchPatientRecordings($(this).val(), $('#nurseSelect').val());
        }
    });

    $('#generateSummaryBtn').click(function() {
        generateEndOfDaySummary();
    });

    function generateEndOfDaySummary() {
        const selectedPatientId = $('#patientSelect').val();
        const selectedNurseId = $('#nurseSelect').val();

        $.ajax({
            url: '/generate_summary',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                patient_id: selectedPatientId,
                nurse_id: selectedNurseId
            }),
            success: function(response) {
                if (response.status === 'success') {
                    $('#summaryContent').text(response.summary);
                    $('#summaryDate').text('Summary generated on: ' + new Date().toLocaleString());
                    alert('End of day summary generated successfully.');
                } else {
                    alert('Error generating summary: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error:', error);
                alert('Error generating summary. Please try again.');
            }
        });
    }

    function fetchLatestSummary() {
        const selectedPatientId = $('#patientSelect').val();
        const selectedNurseId = $('#nurseSelect').val();

        if (!selectedPatientId || selectedPatientId === 'add_new' || !selectedNurseId || selectedNurseId === 'add_new') {
            $('#summaryContent').text('Please select a patient and nurse to view the summary.');
            $('#summaryDate').text('');
            return;
        }

        $.ajax({
            url: '/get_latest_summary',
            method: 'GET',
            data: {
                patient_id: selectedPatientId,
                nurse_id: selectedNurseId
            },
            success: function(response) {
                if (response.status === 'success') {
                    $('#summaryContent').text(response.summary);
                    $('#summaryDate').text('Summary date: ' + new Date(response.date).toLocaleString());
                } else {
                    $('#summaryContent').text('No summary available.');
                    $('#summaryDate').text('');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error fetching summary. Please check the console for details.', error);
                console.error('Response:', xhr.responseText);
                $('#summaryContent').text('Error fetching summary. Please try again.');
                $('#summaryDate').text('');
            }
        });
    }

    // Expose checkAndShowGenerateButton to be called from recording.js
    window.checkAndShowGenerateButton = checkAndShowGenerateButton;
    window.fetchLatestSummary = fetchLatestSummary;

    //window.uploadAudio = uploadAudio;
    //window.fetchRecordings = fetchRecordings;

})