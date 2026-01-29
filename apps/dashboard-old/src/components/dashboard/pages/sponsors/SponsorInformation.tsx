import React from 'react';
import { Building2, Mail, Award, Check, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../../../../firebase/client';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { User as FirestoreUser, SponsorTier } from '../../shared/types/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';

export default function SponsorInformation() {
    const { userRole } = useAuth();
    const [user] = useAuthState(auth);
    const [sponsorData, setSponsorData] = React.useState<Partial<FirestoreUser> | null>(null);
    const [loading, setLoading] = React.useState(true); // Start true to avoid flash of stale content
    const [error, setError] = React.useState<string>("");

    React.useEffect(() => {
        if (!user) return;

        setLoading(true);
        setError("");
        // Set up real-time listener for sponsor data
        const unsubscribe = onSnapshot(
            doc(db, 'users', user.uid),
            (userDoc) => {
                if (userDoc.exists()) {
                    setSponsorData(userDoc.data() as FirestoreUser);
                }
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching sponsor data:', error);
                setError('Failed to load sponsor data');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    if (loading) {
        return (
            <div className="p-6 space-y-6" role="status" aria-live="polite" aria-busy="true">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    const getTierColor = (tier?: string) => {
        switch (tier) {
            case 'Diamond':
                return 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100';
            case 'Platinum':
                return 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';
            case 'Gold':
                return 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100';
            case 'Silver':
                return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100';
            case 'Bronze':
                return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100';
            default:
                return 'bg-muted text-muted-foreground border-border hover:bg-muted/80';
        }
    };

    const getTierAmount = (tier?: string) => {
        switch (tier) {
            case 'Diamond':
                return '$5000+';
            case 'Platinum':
                return '$4000';
            case 'Gold':
                return '$3000';
            case 'Silver':
                return '$1500';
            case 'Bronze':
                return '$750';
            default:
                return 'N/A';
        }
    };

    interface Benefit {
        name: string;
        bronze: boolean | string;
        silver: boolean | string;
        gold: boolean | string;
        diamond: boolean | string;
    }

    const benefits: Benefit[] = [
        { name: 'Prominent Logo Placement on Website & Newsletters', bronze: true, silver: true, gold: true, diamond: true },
        { name: 'Tabling/Swag at Major Events', bronze: true, silver: true, gold: true, diamond: true },
        { name: 'Exclusive Access to Student Resume Database', bronze: false, silver: true, gold: true, diamond: true },
        { name: 'Participation in Professional Development Sessions', bronze: false, silver: '3 per year', gold: 'Unlimited', diamond: 'Unlimited' },
        { name: 'Participation in Technical Workshops', bronze: false, silver: '1 per year', gold: 'Unlimited', diamond: 'Unlimited' },
        { name: 'Unlimited Participation in Quarterly Projects', bronze: false, silver: false, gold: true, diamond: true },
        { name: 'Custom Events & Activations', bronze: false, silver: false, gold: true, diamond: true },
    ];

    const renderBenefitIcon = (value: boolean | string) => {
        if (value === true) {
            return <Check className="w-5 h-5 text-green-600" />;
        } else if (value === false) {
            return <X className="w-5 h-5 text-gray-400" />;
        } else {
            return <ArrowRight className="w-5 h-5 text-blue-600" />;
        }
    };
    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            {/* Welcome Card */}
            <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="p-8">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl text-white mb-1">
                                Welcome, {sponsorData?.sponsorOrganization || 'Sponsor'}!
                            </CardTitle>
                            <CardDescription className="text-blue-100 text-base">
                                Thank you for supporting IEEE at UC San Diego
                            </CardDescription>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sponsor Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Organization Info */}
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-xl">
                                <Building2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <CardTitle className="text-lg">Organization Details</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Organization Name</p>
                            <p className="text-base font-medium">
                                {sponsorData?.sponsorOrganization || 'Not specified'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Contact Email</p>
                            <p className="text-base font-medium">{sponsorData?.email || 'Not specified'}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Sponsorship Tier */}
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-xl">
                                <Award className="w-5 h-5 text-purple-600" />
                            </div>
                            <CardTitle className="text-lg">Sponsorship Tier</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Current Tier</p>
                            <Badge
                                variant="outline"
                                className={`px-4 py-2 text-sm font-semibold border ${getTierColor(sponsorData?.sponsorTier)}`}
                            >
                                {sponsorData?.sponsorTier || 'Not assigned'}
                            </Badge>
                        </div>
                        {sponsorData?.autoAssignedSponsor && (
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <p className="text-xs text-blue-800">
                                    ✓ Automatically assigned based on email domain
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Sponsorship Benefits Table */}
            <Card className="shadow-md">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-xl">
                            <Award className="w-5 h-5 text-purple-600" />
                        </div>
                        <CardTitle className="text-lg">Sponsorship Benefits by Tier</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table
                        aria-label="Sponsorship benefits comparison table"
                        classNames={{
                            th: "bg-transparent border-b border-border/30 pb-2",
                            tr: "hover:bg-muted/30 transition-colors"
                        }}
                    >
                        <TableHeader>
                            <TableColumn>BENEFIT</TableColumn>
                            <TableColumn align="center">
                                <div className="flex flex-col items-center gap-1">
                                    <Badge variant="outline" className={getTierColor('Bronze')}>
                                        BRONZE
                                    </Badge>
                                    <span className="text-muted-foreground text-xs font-medium">{getTierAmount('Bronze')}</span>
                                </div>
                            </TableColumn>
                            <TableColumn align="center">
                                <div className="flex flex-col items-center gap-1">
                                    <Badge variant="outline" className={getTierColor('Silver')}>
                                        SILVER
                                    </Badge>
                                    <span className="text-muted-foreground text-xs font-medium">{getTierAmount('Silver')}</span>
                                </div>
                            </TableColumn>
                            <TableColumn align="center">
                                <div className="flex flex-col items-center gap-1">
                                    <Badge variant="outline" className={getTierColor('Gold')}>
                                        GOLD
                                    </Badge>
                                    <span className="text-muted-foreground text-xs font-medium">{getTierAmount('Gold')}</span>
                                </div>
                            </TableColumn>
                            <TableColumn align="center">
                                <div className="flex flex-col items-center gap-1">
                                    <Badge variant="outline" className={getTierColor('Diamond')}>
                                        DIAMOND
                                    </Badge>
                                    <span className="text-muted-foreground text-xs font-medium">{getTierAmount('Diamond')}</span>
                                </div>
                            </TableColumn>
                        </TableHeader>
                        <TableBody>
                            {benefits.map((benefit, index) => (
                                <TableRow key={index}>
                                    <TableCell>{benefit.name}</TableCell>
                                    <TableCell align="center">
                                        <div className="flex items-center justify-center gap-2">
                                            {renderBenefitIcon(benefit.bronze)}
                                            {typeof benefit.bronze === 'string' && (
                                                <span className="text-xs text-blue-600 font-medium">{benefit.bronze}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell align="center">
                                        <div className="flex items-center justify-center gap-2">
                                            {renderBenefitIcon(benefit.silver)}
                                            {typeof benefit.silver === 'string' && (
                                                <span className="text-xs text-blue-600 font-medium">{benefit.silver}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell align="center">
                                        <div className="flex items-center justify-center gap-2">
                                            {renderBenefitIcon(benefit.gold)}
                                            {typeof benefit.gold === 'string' && (
                                                <span className="text-xs text-blue-600 font-medium">{benefit.gold}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell align="center">
                                        <div className="flex items-center justify-center gap-2">
                                            {renderBenefitIcon(benefit.diamond)}
                                            {typeof benefit.diamond === 'string' && (
                                                <span className="text-xs text-blue-600 font-medium">{benefit.diamond}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                {sponsorData?.sponsorTier && (
                    <CardFooter className="bg-blue-50 border-t border-blue-200">
                        <p className="text-sm text-blue-800 text-center w-full">
                            <strong>Your current tier: {sponsorData.sponsorTier}</strong> - You have access to all benefits marked with ✓ or ➡️ in the {sponsorData.sponsorTier} column
                        </p>
                    </CardFooter>
                )}
            </Card>

            {/* Contact Information */}
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-xl">
                            <Mail className="w-5 h-5 text-yellow-600" />
                        </div>
                        <CardTitle className="text-lg">Need Help?</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <CardDescription className="text-base leading-relaxed">
                        If you have any questions about your sponsorship or need assistance accessing the resume database,
                        please contact our team.
                    </CardDescription>
                    <div className="flex gap-4">
                        <Button asChild variant="default" className="gap-2">
                            <a href="mailto:ieee@ucsd.edu">
                                <Mail className="w-4 h-4" />
                                Contact IEEE UCSD
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
