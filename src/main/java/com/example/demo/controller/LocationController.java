package com.example.demo.controller;

import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.model.Location;
import com.example.demo.repository.LocationRepository;

@RestController
@RequestMapping("/api/location")
@CrossOrigin(origins = "*") // Allow requests from all origins (modify as needed)
public class LocationController {

    private final LocationRepository locationRepository;

    public LocationController(LocationRepository locationRepository) {
        this.locationRepository = locationRepository;
    }

    // Update location
    @PostMapping("/update")
    public ResponseEntity<String> updateLocation(@RequestBody Location location) {
        if (location.getDoctorId() == null || location.getDoctorId().isEmpty()) {
            return ResponseEntity.badRequest().body("doctorId is required!");
        }

        try {
            locationRepository.save(location);
            return ResponseEntity.ok("Location updated successfully!");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error updating location: " + e.getMessage());
        }
    }

    // Get location by doctorId
    @GetMapping("/{doctorId}")
    public ResponseEntity<Location> getLocation(@PathVariable String doctorId) {  // Fixed to String
        Optional<Location> location = locationRepository.findByDoctorId(doctorId);
        return location.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
