import React, { useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const Statistiken: React.FC = () => {
    const [zeitraum, setZeitraum] = useState<'heute' | 'woche' | 'monat' | 'jahr'>('monat');

    // Dummy-Daten
    const statistik = {
        umsatz: [1200, 8750, 32500, 284000],
        bestellungen: [3, 25, 110, 960],
        retouren: [50, 300, 1250, 9800],
        marge: [25, 23, 22, 24],
        labels: ['Heute', 'Woche', 'Monat', 'Jahr'],
        artikel: [
            { name: 'Artikel A', umsatz: 14000 },
            { name: 'Artikel B', umsatz: 8200 },
            { name: 'Artikel C', umsatz: 5800 },
            { name: 'Artikel D', umsatz: 2500 },
        ],
        regionen: [
            { name: 'Nord', umsatz: 48000 },
            { name: 'Süd', umsatz: 36000 },
            { name: 'West', umsatz: 29000 },
            { name: 'Ost', umsatz: 22000 },
        ],
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text('Statistikübersicht', 14, 10);
        autoTable(doc, {
            head: [['Zeitraum', 'Umsatz (€)']],
            body: statistik.labels.map((label, i) => [label, statistik.umsatz[i] + ' €']),
        });
        doc.save('statistik.pdf');
    };
    const generateLabels = () => {
        if (zeitraum === 'heute') {
            return Array.from({ length: 24 }, (_, i) => `${i} Uhr`);
        } else if (zeitraum === 'woche') {
            return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        } else if (zeitraum === 'monat') {
            return Array.from({ length: 31 }, (_, i) => `${i + 1}`);
        } else {
            return ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        }
    };

    return (
        <div className="container my-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Statistiken</h2>
                <div className="btn-group">
                    <button className="btn btn-outline-primary btn-sm" onClick={exportPDF}>PDF Export</button>
                </div>
            </div>

            {/* Filterleiste */}
            <div className="card shadow-sm p-3 mb-4">
                <div className="row g-3">
                    <div className="col-md-3">
                        <label className="form-label">Zeitraum</label>
                        <select className="form-select" value={zeitraum} onChange={e => setZeitraum(e.target.value as any)}>
                            <option value="heute">Heute</option>
                            <option value="woche">Woche</option>
                            <option value="monat">Monat</option>
                            <option value="jahr">Jahr</option>
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Mitarbeiter</label>
                        <input className="form-control" placeholder="z. B. Max" />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Kunde</label>
                        <input className="form-control" placeholder="z. B. Müller GmbH" />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Kategorie</label>
                        <input className="form-control" placeholder="z. B. Süßwaren" />
                    </div>
                </div>
            </div>

            {/* Umsatz-Diagramme nebeneinander */}
            <div className="row g-4 mb-5">
                {/* Umsatz Balkendiagramm */}
                <div className="col-md-7">
                    <div className="card shadow-sm p-4 h-100">
                        <h5 className="mb-3">Umsatz nach Zeitraum</h5>
                        <Bar
                            data={{
                                labels: generateLabels(),
                                datasets: [
                                    {
                                        label: 'Umsatz (€)',
                                        data: statistik.umsatz.slice(0, generateLabels().length),
                                        backgroundColor: 'rgba(13, 110, 253, 0.6)',
                                        borderRadius: 6,
                                    },
                                ],
                            }}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: { display: false },
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: {
                                            callback: (value) => `${value} €`,
                                        },
                                    },
                                },
                            }}
                        />
                    </div>
                </div>

                {/* Umsatzanteile nach Artikel */}
                <div className="col-md-5">
                    <div className="card shadow-sm p-4 h-100">
                        <h5 className="mb-3">Umsatzanteile nach Artikeln</h5>
                        <Pie
                            data={{
                                labels: statistik.artikel.map(a => a.name),
                                datasets: [
                                    {
                                        data: statistik.artikel.map(a => a.umsatz),
                                        backgroundColor: ['#0d6efd', '#20c997', '#ffc107', '#6610f2'],
                                    },
                                ],
                            }}
                            options={{
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                    },
                                },
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Statistiken;